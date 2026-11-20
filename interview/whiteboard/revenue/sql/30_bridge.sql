-- The bridge: walk from one named number to the other, one rule at a time.
-- Every step is computed from the rows, and the last line is what no rule
-- explains. If that line is not zero, you have found a bug, not a definition.
WITH p AS (            -- Product's population: placed in October, UTC
    SELECT * FROM orders
    WHERE ordered_at >= TIMESTAMPTZ '2026-10-01 00:00 UTC'
      AND ordered_at <  TIMESTAMPTZ '2026-11-01 00:00 UTC'
), f AS (              -- Finance's population: real orders fulfilled in October, New York
    SELECT * FROM orders
    WHERE NOT is_test
      AND fulfilled_at >= TIMESTAMPTZ '2026-10-01 00:00 America/New_York'
      AND fulfilled_at <  TIMESTAMPTZ '2026-11-01 00:00 America/New_York'
), steps AS (
    SELECT 1 AS step, 'Gross Order Value (Product)' AS line,
           (SELECT sum(subtotal + tax) FROM p) AS amount
    UNION ALL SELECT 2, 'less sales tax collected for the state',
           -(SELECT sum(tax) FROM p)
    UNION ALL SELECT 3, 'less test orders',
           -(SELECT sum(subtotal) FROM p WHERE is_test)
    UNION ALL SELECT 4, 'less October orders not fulfilled in October',
           -(SELECT sum(subtotal) FROM p
             WHERE NOT is_test AND order_id NOT IN (SELECT order_id FROM f))
    UNION ALL SELECT 5, 'plus earlier orders fulfilled in October',
           (SELECT sum(subtotal) FROM f WHERE order_id NOT IN (SELECT order_id FROM p))
    UNION ALL SELECT 6, 'less refunds issued in October',
           -(SELECT sum(r.amount) FROM refunds r JOIN orders o USING (order_id)
             WHERE NOT o.is_test
               AND r.refunded_at >= TIMESTAMPTZ '2026-10-01 00:00 America/New_York'
               AND r.refunded_at <  TIMESTAMPTZ '2026-11-01 00:00 America/New_York')
), finance AS (
    SELECT (SELECT sum(subtotal) FROM f)
         - (SELECT sum(r.amount) FROM refunds r JOIN orders o USING (order_id)
            WHERE NOT o.is_test
              AND r.refunded_at >= TIMESTAMPTZ '2026-10-01 00:00 America/New_York'
              AND r.refunded_at <  TIMESTAMPTZ '2026-11-01 00:00 America/New_York') AS amount
)
SELECT step, line, amount,
       sum(amount) OVER (ORDER BY step) AS running_total
FROM steps
UNION ALL
SELECT 7, 'Recognized Revenue (Finance)', amount, amount FROM finance
UNION ALL
SELECT 8, 'unexplained by any rule', (SELECT amount FROM finance) - (SELECT sum(amount) FROM steps), NULL
ORDER BY step;
