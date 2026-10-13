SET TIME ZONE 'UTC';
DROP TABLE IF EXISTS fact_subscription_month;
CREATE TABLE fact_subscription_month (   -- grain: one row per account per month with MRR > 0 (month-end snapshot)
  account_id  BIGINT        NOT NULL,
  month       DATE          NOT NULL,   -- first day of month
  mrr         NUMERIC(12,2) NOT NULL CHECK (mrr > 0),
  PRIMARY KEY (account_id, month)
);
INSERT INTO fact_subscription_month VALUES
 (1,'2026-07-01',100),(1,'2026-08-01',100),(1,'2026-09-01',150),
 (2,'2026-07-01', 50),(2,'2026-08-01', 50),
 (3,'2026-08-01', 80),(3,'2026-09-01', 60),
 (4,'2026-07-01', 40),(4,'2026-09-01', 40),
 (5,'2026-09-01',200),
 (6,'2026-07-01', 30),(6,'2026-08-01', 30),(6,'2026-09-01', 30);

-- @setup-end

WITH bounds AS (
  SELECT MIN(month) AS first_month, MAX(month) AS last_month FROM fact_subscription_month
), months AS (
  SELECT generate_series(first_month, last_month, INTERVAL '1 month')::date AS month FROM bounds
), accounts AS (
  SELECT DISTINCT account_id FROM fact_subscription_month
), grid AS (                       -- dense account x month grid so a churned month exists as 0
  SELECT a.account_id, m.month, COALESCE(f.mrr, 0) AS mrr
  FROM accounts a CROSS JOIN months m
  LEFT JOIN fact_subscription_month f ON f.account_id = a.account_id AND f.month = m.month
), moves AS (
  SELECT account_id, month, mrr,
         LAG(mrr, 1, 0::numeric) OVER (PARTITION BY account_id ORDER BY month) AS prev_mrr,
         BOOL_OR(mrr > 0) OVER (PARTITION BY account_id ORDER BY month
                                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS active_before
  FROM grid
)
SELECT month,
       COALESCE(SUM(prev_mrr), 0)                                                                  AS opening_mrr,
       COALESCE(SUM(mrr) FILTER (WHERE prev_mrr = 0 AND mrr > 0 AND NOT COALESCE(active_before, false)), 0) AS new_mrr,
       COALESCE(SUM(mrr) FILTER (WHERE prev_mrr = 0 AND mrr > 0 AND active_before), 0)             AS reactivation_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr > prev_mrr), 0)             AS expansion_mrr,
       COALESCE(SUM(mrr - prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr > 0 AND mrr < prev_mrr), 0) AS contraction_mrr,
       -COALESCE(SUM(prev_mrr) FILTER (WHERE prev_mrr > 0 AND mrr = 0), 0)                         AS churned_mrr,
       COALESCE(SUM(mrr), 0)                                                                       AS closing_mrr
FROM moves
GROUP BY month
ORDER BY month;
