-- Product's dashboard, as it is today. The tile says "Revenue" and "Data Verified".
SELECT to_char(sum(subtotal + tax), 'FM$9,999,999.00') AS "Revenue (Product)"
FROM orders
WHERE ordered_at >= TIMESTAMPTZ '2026-10-01 00:00 UTC'
  AND ordered_at <  TIMESTAMPTZ '2026-11-01 00:00 UTC';
