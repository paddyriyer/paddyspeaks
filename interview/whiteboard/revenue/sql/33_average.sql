-- "Just average them": is $4.4M the answer to ANY question? Enumerate every
-- definition the four rules and two time zones allow, and look for it.
WITH rules AS (
    SELECT tax, tests, gross_of_refunds, basis, tz
    FROM unnest(ARRAY[true, false])                 AS tax(tax)
    CROSS JOIN unnest(ARRAY[true, false])           AS tests(tests)
    CROSS JOIN unnest(ARRAY[true, false])           AS g(gross_of_refunds)
    CROSS JOIN unnest(ARRAY['placed', 'fulfilled']) AS basis(basis)
    CROSS JOIN unnest(ARRAY['UTC', 'America/New_York']) AS tz(tz)
), defs AS (
    SELECT r.*,
           (SELECT sum(o.subtotal + CASE WHEN r.tax THEN o.tax ELSE 0 END)
            FROM orders o
            WHERE (r.tests OR NOT o.is_test)
              AND CASE r.basis WHEN 'placed' THEN o.ordered_at ELSE o.fulfilled_at END
                  >= ('2026-10-01'::timestamp AT TIME ZONE r.tz)
              AND CASE r.basis WHEN 'placed' THEN o.ordered_at ELSE o.fulfilled_at END
                  <  ('2026-11-01'::timestamp AT TIME ZONE r.tz))
         - CASE WHEN r.gross_of_refunds THEN 0 ELSE
           (SELECT sum(x.amount) FROM refunds x JOIN orders o USING (order_id)
            WHERE (r.tests OR NOT o.is_test)
              AND x.refunded_at >= ('2026-10-01'::timestamp AT TIME ZONE r.tz)
              AND x.refunded_at <  ('2026-11-01'::timestamp AT TIME ZONE r.tz)) END
           AS amount
    FROM rules r
)
SELECT count(*)                                         AS definitions,
       count(DISTINCT amount)                           AS distinct_answers,
       count(*) FILTER (WHERE amount = 4400000.00)      AS definitions_giving_4_4m,
       min(abs(amount - 4400000.00))                    AS nearest_miss
FROM defs;
