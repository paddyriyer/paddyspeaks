-- The day's three orders, and what the payment path actually did with them.
CREATE TABLE orders (
    order_id     BIGINT PRIMARY KEY,
    customer_id  BIGINT NOT NULL,
    amount_minor BIGINT NOT NULL,
    order_date   DATE   NOT NULL
);
INSERT INTO wallet VALUES (1, 5000), (2, 5000), (3, 5000);
INSERT INTO orders VALUES (1001, 1, 500, '2026-11-17'),
                          (1002, 2, 500, '2026-11-17'),
                          (1003, 3, 700, '2026-11-17');

SELECT charge('k-1001-a', 1001, 1, 500);   -- timed out at the client...
SELECT charge('k-1001-b', 1001, 1, 500);   -- ...which retried with a NEW key: double charge
SELECT charge('k-1003',   1003, 3, 700);   -- timed out...
SELECT charge('k-1003',   1003, 3, 700);   -- ...retried with the SAME key: returns intent, no money moves
-- order 1002: the charge call was never made (a dropped message). Nothing errors.
